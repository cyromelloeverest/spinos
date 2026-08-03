export function linkedinPersonSearchUrl(personName: string, companyName: string): string {
  const query = [personName, companyName].filter(Boolean).join(" ");
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(query)}`;
}

export function linkedinCompanySearchUrl(companyName: string): string {
  return `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(companyName)}`;
}
