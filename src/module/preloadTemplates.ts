export async function preloadTemplates(): Promise<Handlebars.TemplateDelegate[]> {
  const templatePaths: string[] = [
    // Add paths to "modules/foundryvtt-buff-wizard/templates"
  ];

  return loadTemplates(templatePaths);
}
