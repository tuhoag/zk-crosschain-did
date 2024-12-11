use std::collections::HashMap;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CredentialIssuanceParams {
    pub subject: String,
    pub data: HashMap<String, String>,
}

#[derive(Deserialize, Debug)]
pub struct StatusQueryParams {
    pub time: Option<u64>,
}