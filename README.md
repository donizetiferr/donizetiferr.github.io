# Public project link compatibility

This repository keeps previously published GitHub Pages links working after an existing project repository is renamed. It is not the application source.

- Current Answer Lens source: https://github.com/donizetiferr/answer-lens
- Current app: https://donizetiferr.github.io/answer-lens/
- Previous published app URL: `/livre-10/`, now a redirect.

GitHub redirects repository URLs after a rename, but does not redirect project-site URLs. The compatibility route preserves the original public media and v1 runtime assets for open tabs. Its small replacement service worker redirects only a later navigation; it does not navigate open tabs or erase local storage/caches. The application uses origin-scoped local storage, so saved comparisons remain available at the new path on this same origin.

Source: https://docs.github.com/en/repositories/creating-and-managing-repositories/renaming-a-repository

The preserved v1 Answer Lens files are MIT licensed, copyright 2026 Donizeti Ferreira. They came from reviewed commit `8c1783a35e07294f2eb67cb8840d1b5dfa210b2d`.
