use std::env;

use serde::{Deserialize, Serialize};

pub const DEFAULT_API_PORT: u16 = 8000;
pub const DEFAULT_NAME: &str = "api";
pub const DEFAULT_STATUSES_COLLECTION_NAME: &str = "status_states";
pub const DEFAULT_DB_NAME: &str = "mydatabase";
pub const DEFAULT_MONGO_URL: &str = "mongodb://localhost:27017";

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Config {
    pub api_port: u16,
    pub name: String,
    pub statuses_collection_name: String,
    pub db_name: String,
    pub mongo_url: String,
}

pub fn load_config() -> Config {
    Config {
        api_port: env::var("API_PORT").map_or(DEFAULT_API_PORT, |x| x.parse().unwrap()),
        name: env::var("NAME").unwrap_or(DEFAULT_NAME.to_string()),
        statuses_collection_name: env::var("COLLECTION").unwrap_or(DEFAULT_STATUSES_COLLECTION_NAME.to_string()),
        db_name: env::var("DB").unwrap_or(DEFAULT_DB_NAME.to_string()),
        mongo_url: env::var("MONGO_URL").unwrap_or(DEFAULT_MONGO_URL.to_string()),
    }
}