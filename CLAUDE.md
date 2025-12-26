# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This repository is a sample project for learning container applications, aimed at mastering technologies such as Amazon ECS/EKS and Argo CD.

## Project Structure

- `app/conex`: Spring Boot application source code
- `infra`: CDK source code (to be added in the future)

## Coding Standards

### Language Rules

- **Source Code**: All source code, including comments, must be written in English.
- **HTML/Templates**: All user-facing text in HTML templates, JSP, Thymeleaf, etc. must be written in English.
- **Documentation**: Documentation and README files should be written in English for international collaboration.

## Technology Stack

- Java 25
- Spring Boot 4.0.1
- MyBatis 4.0.0
- Thymeleaf (Template Engine)
- Gradle (using Gradle Wrapper)
- Testcontainers (Test Environment)

## Development Commands

### Build and Test

```bash
# Build the application
./app/conex/gradlew -p app/conex build

# Run tests
./app/conex/gradlew -p app/conex test

# Run a specific test class
./app/conex/gradlew -p app/conex test --tests "io.github.tttol.conex.ConexApplicationTests"

# Run a specific test method
./app/conex/gradlew -p app/conex test --tests "io.github.tttol.conex.ConexApplicationTests.contextLoads"
```

### Running the Application

```bash
# Start the Spring Boot application
./app/conex/gradlew -p app/conex bootRun
```

### Other Development Commands

```bash
# Check dependencies
./app/conex/gradlew -p app/conex dependencies

# Clean the project
./app/conex/gradlew -p app/conex clean
```

## Architecture

### Application Structure

- **Package Root**: `io.github.tttol.conex`
- **Entry Point**: `ConexApplication.java` - Standard Spring Boot application class
- **Test Configuration**: Supports integration testing environment using Testcontainers
  - `TestcontainersConfiguration.java`: Testcontainers configuration class (leveraging Spring Boot 4.0 Dev Services feature)

### Key Dependencies

- **Web**: Spring Web MVC (for RESTful API implementation)
- **Template Engine**: Thymeleaf (for dynamic HTML page generation)
- **Data Access**: MyBatis (SQL mapper framework)
- **Development Tools**: Spring Boot DevTools (hot reload support)
- **Testing**: Testcontainers (container-based testing environment)
- **Code Generation**: Lombok (reduces boilerplate code)

### Testing Strategy

This project uses Testcontainers, enabling Docker container-based testing during development. Tests are executed using JUnit 5 via `useJUnitPlatform()`.
