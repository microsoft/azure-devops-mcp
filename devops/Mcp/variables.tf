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

variable "ado_mcp_obo_client_id" {
  type        = string
  description = "Microsoft Entra application (client) ID used by the MCP server for OBO token exchange."
  validation {
    condition     = length(var.ado_mcp_obo_client_id) > 0
    error_message = "ADO MCP OBO client ID should be a non-empty string."
  }
}

variable "ado_mcp_obo_client_secret" {
  type        = string
  sensitive   = true
  description = "Client secret used by the MCP server for OBO token exchange."
  validation {
    condition     = length(var.ado_mcp_obo_client_secret) > 0
    error_message = "ADO MCP OBO client secret should be a non-empty string."
  }
}

variable "ado_mcp_obo_tenant_id" {
  type        = string
  description = "Microsoft Entra tenant ID used by the MCP server for OBO token exchange."
  validation {
    condition     = length(var.ado_mcp_obo_tenant_id) > 0
    error_message = "ADO MCP OBO tenant ID should be a non-empty string."
  }
}

variable "microsoft_auth_client_id" {
  type        = string
  description = "Microsoft Entra application (client) ID used by Container Apps authentication."
  validation {
    condition     = length(var.microsoft_auth_client_id) > 0
    error_message = "Microsoft auth client ID should be a non-empty string."
  }
}

variable "microsoft_auth_tenant_id" {
  type        = string
  description = "Microsoft Entra tenant ID used by Container Apps authentication."
  validation {
    condition     = length(var.microsoft_auth_tenant_id) > 0
    error_message = "Microsoft auth tenant ID should be a non-empty string."
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
