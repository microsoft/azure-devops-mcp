# Governance

### Domain Naming and Organization
- Our tools are named `<domain>_tool` to reflect the domain they belong to.
- Files are organized by domain, e.g., `tools/repositories.ts`.
- If you are working by enabling exclusively the domains you depend on, you need that domain enabled.

### Domain Ownership: **[here](https://github.com/microsoft/azure-devops-mcp/wiki/Area-Owners)**
- Domain owners from Azure DevOps (ADO) teams are responsible for maintaining their respective domains. 
- This ownership model was already being followed implicitly and is now formalized.
- Stability of Domains: Domains are expected to uphold a high level of stability. Any breaking changes will be managed with due diligence, similar to our tool deprecation process (e.g., deprecation notices, and major version updates for Generally Available features). **Domain owners** are pivotal in maintaining this stability on **available tools** for agents, ensuring their domains align with the project's overarching goals and long-term vision.

## Becoming a Maintainer
- Maintainers are contributors who have demonstrated expertise and consistent contributions to a specific domain.
- To become a maintainer, contributors must:
  - Submit high-quality contributions over a sustained period.
  - Actively participate in code reviews and discussions.
  - Demonstrate a deep understanding of the domain and its tools.
- New maintainers are nominated by existing maintainers and approved by the governance team.

## Hierarchy and Responsibilities
- **Contributors**: Anyone who submits code, documentation, or other improvements.
- **Maintainers**: Contributors with write access to the repository, responsible for reviewing and merging pull requests, and ensuring code quality.
- **Domain Owners**: Maintainers with additional responsibility for a specific domain, ensuring its long-term health and alignment with project goals.
- **Governance Team**: Oversees the overall direction of the project, resolves disputes, and ensures adherence to governance policies.

## Decision-Making Process
- Decisions are made collaboratively, with input from contributors, maintainers, and domain owners.
- For significant changes, proposals are discussed in open forums and require consensus from the governance team.
- In cases of disagreement, the governance team has the final say.

## Code of Conduct
- This project follows the [Microsoft Open Source Code of Conduct](./CODE_OF_CONDUCT.md).
- Violations of the Code of Conduct may result in temporary or permanent removal from the project.

## Transparency and Communication
- All governance decisions, including maintainer nominations and major changes, are documented and shared publicly.
- Regular updates are provided to the community through release notes, blog posts, and other channels.
