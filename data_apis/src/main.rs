use actix_web::{web, App, HttpServer};
use data_apis::{config::load_config, routes::{self}, utils::AppData};


#[actix_web::main]
async fn main() -> std::io::Result<()> {
    println!("Loading configuration...");
    let config = load_config();

    match AppData::new(&config).await {
        Ok(app_data) => {
            println!("Starting server {:?} at {:?}", config.name, config.api_port);

            HttpServer::new(move || {
                App::new()
                    .app_data(web::Data::new(app_data.clone())) // Clone app_data for each instance
                    .configure(routes::initialize)
            })
            .bind(("0.0.0.0", config.api_port))? // Corrected IP and port syntax
            .run()
            .await // Await the server's run method
        }
        Err(e) => {
            eprintln!("Failed to initialize app data: {:?}", e);
            Err(std::io::Error::new(std::io::ErrorKind::Other, "Initialization failed"))
        }
    }
}
