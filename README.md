# ReportGenerator

![Github code size in bytes](https://img.shields.io/github/languages/code-size/lsuhsc-caipp-core-b/reportgenerator?style=flat-square)
![GitHub package.json version](https://img.shields.io/github/package-json/v/lsuhsc-caipp-core-b/reportgenerator?style=flat-square)

> ReportGenerator is a reporting service that transforms project data stored in
> PathAtlas into structured reports using customizable templates and
> MongoDB-backed data sources.

## Overview

ReportGenerator provides a flexible platform for generating reports from indexed
project data. It integrates with
[PathAtlas](https://github.com/LSUHSC-CAIPP-Core-B/PathAtlas) to retrieve
project and file information, then combines that data with configurable
templates to produce consistent, repeatable outputs.

The service is designed for automated reporting workflows, project analysis, and
data-driven document generation.

## Features

- Generate reports from MongoDB datasets
- Integrates directly with
  [PathAtlas](https://github.com/LSUHSC-CAIPP-Core-B/PathAtlas) project indexes
- Template-based report generation
- REST and service-oriented architecture
- Configurable deployment through environment variables
- Designed for automation and scheduled workflows

## Quick Start

### Prerequisites

Before running the service, ensure the following dependencies are installed:

- PathAtlas (required)
- Node.js (v18 or newer recommended)
- Yarn

### Installation

Clone the repository and install dependencies:

```sh
git clone https://github.com/LSUHSC-CAIPP-Core-B/ReportGenerator.git
cd ReportGenerator
yarn install
```

### Development

Start the development server:

```sh
yarn dev
```

### Production Build

Build the application:

```sh
yarn build
```

## Configuration

The application is configured through environment variables.

| Variable            | Description                    | Default   |
| ------------------- | ------------------------------ | --------- |
| `DATABASE_PROTOCOL` | MongoDB connection protocol    | `mongodb` |
| `DATABASE_URL`      | MongoDB hostname or IP address | —         |
| `DATABASE_USER`     | Database username              | —         |
| `DATABASE_PASS`     | Database password              | —         |
| `DATABASE_NAME`     | Database name                  | —         |
| `WEBSERVER_PORT`    | HTTP server port               | `15632`   |

### Example Configuration

```env
DATABASE_PROTOCOL=mongodb
DATABASE_URL=localhost:27017
DATABASE_NAME=reports

WEBSERVER_PORT=15632

# REQUIRED
NODE_ENV=dev
```

## Architecture

```text
PathAtlas
    │
    ▼
MongoDB
    │
    ▼
ReportGenerator
    │
    ▼
Generated Reports
```

ReportGenerator retrieves project and file metadata from MongoDB, processes the
data through report templates, and produces structured outputs suitable for
analysis, auditing, and documentation workflows.

## Related Projects

- PathAtlas — File indexing & management, and project metadata collection.
- ReportGenerator — Template-driven reporting built on top of PathAtlas data.

## License

Licensed under the GPL-3.0 License.

© 2025 LSUHS
