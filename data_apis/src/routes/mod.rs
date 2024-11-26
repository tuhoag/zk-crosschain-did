use actix_web::{middleware::Logger, web};

pub mod status_routes;
pub mod credential_routes;
pub mod app_routes;

pub fn initialize(config: &mut web::ServiceConfig) {
    config.service(
        web::scope("")
            // .wrap(Logger::default())
            .configure(credential_routes::initialize)
            .configure(status_routes::initialize)
            .configure(app_routes::initialize),

    );

}
