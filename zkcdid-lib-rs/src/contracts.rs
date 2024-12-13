use alloy::sol;

sol!(
    #[allow(missing_docs)]
    #[sol(rpc)]
    #[derive(Debug)]
    ZKOracleManager,
    "../deployments/artifacts/ZKOracleManager.json"
);