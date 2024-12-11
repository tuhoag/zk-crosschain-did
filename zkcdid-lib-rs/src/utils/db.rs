use bson::doc;
use mongodb::{options::ClientOptions, Client, Database};

use crate::config::Config;

pub async fn get_db(config: &Config) -> Result<Database, mongodb::error::Error> {
    let client_options = ClientOptions::parse(config.get_mongo_url()).await?;

    match Client::with_options(client_options) {
        Ok(client) => {
            let database = client.database(&config.get_db_name());
            database.run_command(doc! {"ping": 1}).await?;
            Ok(database)
        },
        Err(e) => Err(e.into()),
    }
}