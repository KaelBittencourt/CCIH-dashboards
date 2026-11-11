declare module "virtual:ccih-preview" {
  const snapshots: import("../shared/domain").Snapshot[];
  export default snapshots;
}
declare module "virtual:ccih-quality-issues" {
  const issues: import("../shared/domain").QualityIssue[];
  export default issues;
}
