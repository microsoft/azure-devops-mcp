resource "azurerm_container_registry" "acr" {
  name                = "${replace(local.resource_prefix, "-", "")}registry"
  resource_group_name = azurerm_resource_group.stage.name
  location            = azurerm_resource_group.stage.location
  sku                 = "Standard"
  admin_enabled       = true
  tags                = local.default_tags
}

