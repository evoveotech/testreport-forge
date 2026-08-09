export {
  VcsConnector, ItsConnector, VcsCommit, ItsIssue, TeamMapping,
  computeTestsAuthored, computeFixesLanded, matchesAnyPattern,
  GitHubConnector, GitLabConnector, JiraConnector, LinearConnector,
} from './connectors';
export { ConnectorService } from './connector-service';
export type { ConnectorConfig } from './connector-service';
