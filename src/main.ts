import * as fs from 'fs';
import * as path from 'path';
import * as process from 'process';
import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as tc from '@actions/tool-cache';
import * as github from '@actions/github';

// https://github.com/actions/setup-go/blob/75259a5ae02e59409ee6c4fa1e37ed46ea4e5b8d/src/installer.ts#L2
let tempDirectory = process.env['RUNNER_TEMPDIRECTORY'] || '';

// https://github.com/actions/setup-go/blob/v1.1.1/src/installer.ts#L14-L27
if (!tempDirectory) {
  let baseLocation;
  if (process.platform === 'win32') {
    // On windows use the USERPROFILE env variable
    baseLocation = process.env['USERPROFILE'] || 'C:\\';
  } else {
    if (process.platform === 'darwin') {
      baseLocation = '/Users';
    } else {
      baseLocation = '/home';
    }
  }
  tempDirectory = path.join(baseLocation, 'actions', 'temp');
}

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

    const tempFormulaPath = path.join(tempDirectory, path.basename(formulaPath));

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
      fs.writeFileSync(tempFormulaPath, new Buffer(data.content, 'base64'));
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

    let message = core.getInput("commit-message");
    if (message.length == 0) {
      message = `Bump ${appOwner}/${appRepo} formula`;
    }

    await octokit.repos.createOrUpdateFile({
      owner: hbOwner,
      repo: hbRepo,
      path: formulaPath,
      content: fs.readFileSync(tempFormulaPath, 'base64'),
      message,
      sha: data.sha,
      branch: core.getInput("tap-branch"),
    });
  } catch (error) {
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
