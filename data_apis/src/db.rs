use mongodb::{options::ClientOptions, Client, Database};

use crate::config::Config;

pub async fn get_db(config: &Config) -> Result<Database, mongodb::error::Error> {
    let client_options = ClientOptions::parse(config.mongo_url.clone()).await?;
    Client::with_options(client_options)
        .and_then(|client| Ok(client.database(&config.db_name)))
}

