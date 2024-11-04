use actix_web::web;

pub mod status_routes;
pub mod credential_routes;
pub mod app_routes;

pub fn initialize(config: &mut web::ServiceConfig) {
    config.service(
        web::scope("")
            .configure(credential_routes::initialize)
            .configure(status_routes::initialize)
            .configure(app_routes::initialize),

    );

}
