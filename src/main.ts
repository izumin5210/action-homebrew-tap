import * as fs from 'fs';
import * as path from 'path';
import * as process from 'process';
import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as tc from '@actions/tool-cache';
import * as io from '@actions/io';
import * as github from '@actions/github';

async function run() {
  try {
    const ghToken = core.getInput("token", { required: true });
    const tapGhToken = core.getInput("tap-token", { required: true });

    const [appOwner, appRepo] = (process.env.GITHUB_REPOSITORY || "").split('/');
    const [hbOwner, hbRepo] = core.getInput("tap", { required: true }).split('/');

    let formulaPath = core.getInput("formula");
    if (formulaPath.length == 0) {
      if (appRepo == "") {
        core.setFailed('failed to get formula path');
        return
      }
      formulaPath = path.join("Formula", `${appRepo}.rb`)
    }

    core.debug(`Check ${formulaPath} in ${hbOwner}/${hbRepo}`);

    const octokit = new github.GitHub(tapGhToken);
    const { data } = await octokit.repos.getContents({
      owner: hbOwner,
      repo: hbRepo,
      path: formulaPath,
    });

    core.debug(`Get contents result: ${JSON.stringify(data)}`);

    if (Array.isArray(data) || data.type != "file") {
      core.setFailed(`${formulaPath} in ${hbOwner}/${hbRepo} is not a file`)
      return
    }

    const tempDir = path.join((process.env['HOME'] as string), 'temp');
    await io.mkdirP(tempDir);
    const tempFormulaPath = path.join(tempDir, path.basename(formulaPath));

    let maltmillArgs = [`-token=${ghToken}`];

    if (data.content == null) {
      core.debug("Starting: Create a new formula");
      maltmillArgs = [
        'new',
        ...maltmillArgs,
        '-w',
        `${appOwner}/${appRepo}`,
      ];
    } else {
      core.debug("Starting: Write an existing formula");
      const buf = new Buffer(data.content, 'base64');
      fs.writeFileSync(tempFormulaPath, buf);
      core.debug(`Current formula:\n${buf.toString()}`);
      core.debug("Starting: Update an existing formula");
      maltmillArgs = [
        ...maltmillArgs,
        '-w',
         tempFormulaPath,
      ];
    }

    const maltmillVersion = core.getInput('maltmill-version');
    const maltmillPath = await getMaltmillPath(maltmillVersion);
    await exec.exec(maltmillPath, maltmillArgs);

    const newFormulaContent = fs.readFileSync(tempFormulaPath, 'base64');
    core.debug(`New formula:\n${(new Buffer(newFormulaContent, 'base64')).toString()}`)

    let message = core.getInput("commit-message");
    if (message.length == 0) {
      message = `Bump ${appOwner}/${appRepo} formula`;
    }

    const payload = {
      owner: hbOwner,
      repo: hbRepo,
      path: formulaPath,
      content: newFormulaContent,
      message,
      sha: data.sha,
      branch: core.getInput("tap-branch"),
    };
    if (payload.sha == "") {
      delete payload.sha;
    }
    if (payload.branch == "") {
      delete payload.branch;
    }
    core.debug(`Send createOrUpdateFile: ${JSON.stringify(payload)}`);

    await octokit.repos.createOrUpdateFile(payload);
  } catch (error) {
    core.debug(`error: ${JSON.stringify(error)}`);
    core.setFailed(error.message);
  }
}

async function getMaltmillPath(version: string): Promise<string> {
  const toolPath = tc.find('maltmill', version) || await downloadMaltmill(version);
  core.debug(`contained entries: ${fs.readdirSync(toolPath)}`);
  return path.join(toolPath, "maltmill");
}

async function downloadMaltmill(version: string): Promise<string> {
  const archivePath = await tc.downloadTool(getUrl(version));
  const extractedPath = await tc.extractTar(archivePath);
  const toolPath = path.join(extractedPath, getArchiveName(version));
  const cachePath = await tc.cacheDir(toolPath, "maltmill", version);
  core.debug(`maltmill is cached under ${cachePath}`);
  return cachePath;
}

function getUrl(version: string): string {
  return `https://github.com/Songmu/maltmill/releases/download/${version}/${getArchiveName(version)}.tar.gz`
}

function getArchiveName(version: string): string {
  return `maltmill_${version}_linux_amd64`
}

run();
