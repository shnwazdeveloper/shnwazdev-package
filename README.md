# @shnwazdeveloper/shnwazdev

Personal starter utilities for `shnwazdev` projects, published through GitHub Packages.

## Install

Create or update `.npmrc` in the project that will use this package:

```ini
@shnwazdeveloper:registry=https://npm.pkg.github.com
```

Then install:

```bash
npm install @shnwazdeveloper/shnwazdev
```

## Use

```js
import { greet, profile } from "@shnwazdeveloper/shnwazdev";

console.log(greet("Shnwaz"));
console.log(profile());
```

## Scripts

```bash
npm test
npm run pack:check
```

## Publishing

This repository publishes to GitHub Packages when a tag like `v0.1.0` is pushed.
