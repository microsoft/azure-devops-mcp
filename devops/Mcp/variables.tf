variable "application" {
  type        = string
  description = "Application Name. For example, \"ob-app\". Note, application will contain multiple projects (microservices)"
  validation {
    condition     = length(var.application) > 0
    error_message = "Application code should be a non-empty string like \"ob-app\"."
  }
}

variable "build_number" {
  type        = string
  description = "Build number"
  validation {
    condition     = length(var.build_number) > 0
    error_message = "Build number should be a non-empty string like \"1.0.117\"."
  }
}

variable "ado_mcp_auth_token" {
  type        = string
  sensitive   = true
  description = "Azure DevOps PAT used by the MCP server."
  validation {
    condition     = length(var.ado_mcp_auth_token) > 0
    error_message = "ADO MCP auth token should be a non-empty string."
  }
}

variable "project" {
  type        = string
  description = "Project code which is used for naming the stage resources. For example, \"dcslgs-wt\"."
  validation {
    condition     = length(var.project) > 0
    error_message = "Project code should be a non-empty string like \"dcslgs-wt\"."
  }
}

variable "azure_rm_subscription_id" {
  type        = string
  description = "Azure Subscription ID."
  default     = ""
}

variable "resource_location" {
  type        = string
  description = "Moniker of location which is used for placing the stage resources in. For exaple, \"uksouth\", \"canadacentral\"."
  validation {
    condition     = length(var.resource_location) > 0 # Ideally should be checked against a list of possible locations via data source
    error_message = "Stage location moniker should be a non-empty string like \"uksouth\", \"canadacentral\"."
  }
}

