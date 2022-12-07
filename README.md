# valio

A command-line utility that will read your TypeScript files and create helper schema functions to validate your TypeScript interfaces.

### Installation

```
yarn add valio
```

### Usage

The following command will generate an entire TypeScript project on `schema` folder with utilities to both create data structures and validating them.

```
npx valio \
    --include "src/**/*.ts" \
    --include "src/**/*.tsx" \
    --exclude "src/index.ts" \
    --ts-extends ./tsconfig.base.json \
    --ts-reference ./src \
    -o schema
```
