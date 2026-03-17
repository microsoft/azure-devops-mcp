resource "azurerm_resource_group" "stage" {
  name     = "rg-${local.resource_prefix}"
  location = var.resource_location
  tags     = local.default_tags
}
