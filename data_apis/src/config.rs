use std::env;

use serde::{Deserialize, Serialize};

pub const DEFAULT_API_PORT: u16 = 8000;
pub const DEFAULT_NAME: &str = "api";
pub const DEFAULT_API_URL: &str = "http://localhost:3000";
pub const DEFAULT_STATUSES_COLLECTION_NAME: &str = "status_states";
pub const DEFAULT_CREDENTIALS_COLLECTION_NAME: &str = "credentials";
pub const DEFAULT_DB_NAME: &str = "mydatabase";
pub const DEFAULT_MONGO_URL: &str = "mongodb://localhost:27017";
pub const MAX_TRIAL: u8 = 3;

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Config {
    pub api_port: u16,
    pub name: String,
    pub api_url: String,
    pub statuses_collection_name: String,
    pub credential_collection_name: String,
    pub db_name: String,
    pub mongo_url: String,
    pub max_trial: u8,
}

impl Config {
    pub fn new() -> Self {
        Self {
            api_port: env::var("API_PORT").map_or(DEFAULT_API_PORT, |x| x.parse().unwrap()),
            name: env::var("NAME").unwrap_or(DEFAULT_NAME.to_string()),
            api_url: env::var("API_URL").unwrap_or(DEFAULT_API_URL.to_string()),
            statuses_collection_name: env::var("COLLECTION").unwrap_or(DEFAULT_STATUSES_COLLECTION_NAME.to_string()),
            credential_collection_name: env::var("CREDENTIAL_COLLECTION").unwrap_or(DEFAULT_CREDENTIALS_COLLECTION_NAME.to_string()),
            db_name: env::var("DB").unwrap_or(DEFAULT_DB_NAME.to_string()),
            mongo_url: env::var("MONGO_URL").unwrap_or(DEFAULT_MONGO_URL.to_string()),
            max_trial: env::var("MAX_TRIAL").map_or(MAX_TRIAL, |x| x.parse().unwrap()),
        }
    }
}
pub fn load_config() -> Config {
    Config {
        api_port: env::var("API_PORT").map_or(DEFAULT_API_PORT, |x| x.parse().unwrap()),
        name: env::var("NAME").unwrap_or(DEFAULT_NAME.to_string()),
        api_url: env::var("URL").unwrap_or(DEFAULT_API_URL.to_string()),
        statuses_collection_name: env::var("COLLECTION").unwrap_or(DEFAULT_STATUSES_COLLECTION_NAME.to_string()),
        credential_collection_name: env::var("CREDENTIAL_COLLECTION").unwrap_or(DEFAULT_CREDENTIALS_COLLECTION_NAME.to_string()),
        db_name: env::var("DB").unwrap_or(DEFAULT_DB_NAME.to_string()),
        mongo_url: env::var("MONGO_URL").unwrap_or(DEFAULT_MONGO_URL.to_string()),
        max_trial: env::var("MAX_TRIAL").map_or(MAX_TRIAL, |x| x.parse().unwrap()),
    }
}