use actix_web::{web, App, HttpServer};
use data_apis::{routes::{self}, utils::AppData};
use actix_web::middleware::Logger;
use env_logger::Env;
use zkcdid_lib_rs::config::Config;

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    println!("Loading configuration...");
    let config = Config::load_api_config();

    loop {
        println!("Initializing services...");
        if let Ok(app_data) = AppData::new(&config).await {
            println!("Starting server {:?} at {:?}", config.get_name(), config.get_api_port());

            env_logger::init_from_env(Env::default().default_filter_or("info"));

            HttpServer::new(move || {
                App::new()
                    .app_data(web::Data::new(app_data.clone())) // Clone app_data for each instance
                    .wrap(Logger::default())
                    .configure(routes::initialize)
            })
            .bind(("0.0.0.0", config.get_api_port()))? // Corrected IP and port syntax
            .run()
            .await?; // Await the server's run method
        }
    }

    // Ok(())
}
