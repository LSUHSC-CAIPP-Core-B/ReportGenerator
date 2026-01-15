# ReportGenerator

![Github code size in bytes](https://img.shields.io/github/languages/code-size/lsuhsc-caipp-core-b/reportgenerator?style=flat-square)
![GitHub package.json version](https://img.shields.io/github/package-json/v/lsuhsc-caipp-core-b/reportgenerator?style=flat-square)

> A lightweight server, using [PathAtlas](https://github.com/LSUHSC-CAIPP-Core-B/PathAtlas), to generate reports from Mongo Databases and Template files.


## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+ recommended)
- [Yarn](https://yarnpkg.com/)

### Development

```sh
$ yarn dev
```

### Environment Variables

| Variable             | Description                                                     | Default Value  |
|:--------------------:|-----------------------------------------------------------------|:--------------:|
| `DATABASE_PROTOCOL`  | The Protocol of the MongoDB database                            | `mongodb`      |
| `DATABASE_URL`       | The IP / Hostname of the MongoDB database                       | ` `            |
| `DATABASE_USER`      | The database username                                           | ` `            |
| `DATABASE_PASS`      | The database password                                           | ` `            |
| `DATABASE_NAME`      | The database name                                               | ` `            |
| `WEBSERVER_PORT`     | The port to use for this service                                | `15632`        |
| `TEMPLATE_DIRECTORY` | The folder that contains the project templates to use           | `./templates`  |


## :open_file_folder: License
GPL-3.0 License © 2025


