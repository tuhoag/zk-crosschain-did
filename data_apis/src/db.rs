use mongodb::{options::ClientOptions, Client, Database};

use crate::{config::Config, errors::AppResult};

pub async fn get_db(config: &Config) -> AppResult<Database> {
    let client_options = ClientOptions::parse(config.mongo_url.clone()).await?;
    Ok(Client::with_options(client_options)
        .and_then(|client| Ok(client.database(&config.db_name)))?)
}