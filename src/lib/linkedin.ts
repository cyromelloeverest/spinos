function stripParenthetical(name: string): string {
  return name.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
}

export function linkedinPersonSearchUrl(personName: string, companyName: string): string {
  const query = [personName, stripParenthetical(companyName)]
    .filter(Boolean)
    .map((part) => `"${part}"`)
    .join(" ");
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(query)}`;
}

export function linkedinTitleSearchUrl(title: string, companyName: string): string {
  const query = [title, stripParenthetical(companyName)].filter(Boolean).join(" ");
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(query)}`;
}

export function linkedinCompanySearchUrl(companyName: string): string {
  return `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(stripParenthetical(companyName))}`;
}
