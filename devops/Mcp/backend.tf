terraform {
  backend "azurerm" {
    resource_group_name  = "rg-ob-ai-infra"
    storage_account_name = "obaiinfrastorage"
    container_name       = "ob-ai-devops-mcp"
    key                  = "ob-ai-devops-mcp.tfstate"
  }
}
