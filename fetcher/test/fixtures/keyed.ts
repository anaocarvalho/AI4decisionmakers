// Hand-written fixtures following each API's documented response shape (no live keys were available
// when these were written). If a provider changes its format, update these alongside the source.
export const adzunaResponse = {
  count: 2,
  results: [
    {
      id: "4983746512",
      title: "Junior <strong>Data Analyst</strong>",
      description: "We are seeking an entry level data analyst… 0-2 years of experience…",
      created: "2026-11-18T09:12:44Z",
      redirect_url: "https://www.adzuna.com/details/4983746512",
      company: { display_name: "Acme Analytics" },
      location: { display_name: "New York City, New York", area: ["US", "New York", "New York City"] },
    },
    {
      id: "4983746999",
      title: "Economic Research Assistant",
      description: "Support economists… STEM OPT candidates welcome.",
      created: "2026-11-17T15:00:00Z",
      redirect_url: "https://www.adzuna.com/details/4983746999",
      company: { display_name: "Policy Lab" },
      location: { display_name: "US", area: ["US"] },
    },
  ],
};

export const jsearchResponse = {
  status: "OK",
  data: [
    {
      job_id: "abc123==",
      job_title: "Policy Analyst",
      employer_name: "Example Think Tank",
      job_city: "New York",
      job_state: "NY",
      job_country: "US",
      job_location: "New York, NY",
      job_is_remote: false,
      job_apply_link: "https://careers.example.org/jobs/42",
      job_description: "Entry-level policy analyst. Must be authorized to work without sponsorship.",
      job_posted_at_datetime_utc: "2026-11-19T00:00:00.000Z",
    },
    {
      job_id: "def456==",
      job_title: "Data Analyst (Remote)",
      employer_name: "Remote Co",
      job_city: null,
      job_state: null,
      job_country: "US",
      job_location: null,
      job_is_remote: true,
      job_apply_link: "https://remote.co/jobs/7",
      job_description: "Fully remote. SQL and R.",
      job_posted_at_datetime_utc: null,
    },
  ],
};

export const usajobsResponse = {
  SearchResult: {
    SearchResultCount: 1,
    SearchResultItems: [
      {
        MatchedObjectId: "812345600",
        MatchedObjectDescriptor: {
          PositionTitle: "Economist",
          OrganizationName: "Bureau of Labor Statistics",
          DepartmentName: "Department of Labor",
          PositionLocationDisplay: "New York, New York",
          PositionURI: "https://www.usajobs.gov:443/GetJob/ViewDetails/812345600",
          ApplyURI: ["https://www.usajobs.gov:443/GetJob/ViewDetails/812345600?PostingChannelID="],
          PublicationStartDate: "2026-11-15T00:00:00.0000",
          QualificationSummary: "Bachelor's degree in economics…",
          UserArea: { Details: { JobSummary: "Analyze labor market data.", MajorDuties: ["Prepare reports."], WhoMayApply: { Name: "United States Citizens" } } },
        },
      },
    ],
  },
};
