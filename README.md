# homebrew for GitHub Actions

## Usage:

```yaml
uses: izumin5210/action-homebrew-tap@v1
with:
  tap: izumin5210/homebrew-tools
  token: ${{ secrets.GITHUB_TOKEN }}
  tap-token: ${{ secrets.TAP_GITHUB_TOKEN }} # require `repo` or `public_repo` scope for the tap repository
if: startsWith(github.ref, 'refs/tags/')
```

### With [softprops/action-gh-release](https://github.com/softprops/action-gh-release)

```yaml
name: Release

on: push

jobs:
  build:
    runs-on: ubuntu-latest
    steps:

    # build something to release...

    - name: Create GitHub Release
      uses: softprops/action-gh-release@v1
      with:
        files: './dist/*'
      if: startsWith(github.ref, 'refs/tags/')
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

    - name: Update Homebrew Formula
      uses: izumin5210/action-homebrew-tap@releases/v0
      with:
        tap: izumin5210/homebrew-tools
        token: ${{ secrets.GITHUB_TOKEN }}
        tap-token: ${{ secrets.TAP_GITHUB_TOKEN }}
      if: startsWith(github.ref, 'refs/tags/')
```
