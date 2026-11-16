# MJ Repo — Sileo / Zebra / Cydia repository

A **flat APT repository** containing 11 rootless (`iphoneos-arm64`) tweak packages supplied by the owner. The packages were not modified; their existing activation flows remain inside each DEB.

## Live repository URLs

This directory is hosted inside the public `fahad363636-hue/Ad` repository under `mj/`. The direct GitHub raw source is `https://raw.githubusercontent.com/fahad363636-hue/Ad/main/mj/`. If GitHub Pages deployment is enabled and successful, the canonical URL is `https://fahad363636-hue.github.io/Ad/mj/`. The Page site uses the auto-generated Sileo add-source button.

To maintain the repository, replace only the validated DEB files and regenerate Packages* and Release.

## Maintenance

Put newly approved DEBs into `debs/`, delete obsolete DEBs of the **same** package ID, and run `python3 build_repo.py` on a machine with `dpkg-deb` available. Commit the updated `Packages*`, `Release`, and `.deb` files. The GitHub Pages action deploys the contents. Each `.deb` must be reviewed and tested separately before release.

## Details

- No source code or license secrets are intentionally included in this repository; only public package files.
- These are **pre-existing binaries**, with no alteration to the license mechanisms.
- No GPG/Release.gpg signature is included: some package managers may display an unsigned-source warning.
- `FaceID Menu Lock` is not included because the available package advertises *no license gate*. LiveCam Pilot builds are excluded pending verification. CamVortex Pro 1.0.4 is included as the latest available licensed DEB; this build has not been re-tested here.

## DeepClean 0.4.1

- Package: `com.mohamedjj.deepclean` (rootless `iphoneos-arm64`, iOS 15–17 targeted).
- Public depiction: https://mjrepo.pages.dev/depictions/deepclean/
- The before-and-after iPhone storage screenshots show 198.4 GB and 168.4 GB used on a 256 GB iPhone (a 30 GB difference). Lower app names are obscured.
- A separate 19 GB result is reported by the developer; results vary and have not been independently reproduced here.
- The published `.deb` is the user-supplied 0.4.1 package, with no changes to binaries or licenses. GitHub source blobs were checksum-verified.
