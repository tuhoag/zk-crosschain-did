use actix_web::{web::{self, Data}, HttpResponse, Responder};

use crate::utils::AppData;

async fn get_configuration(app_data: Data<AppData>) -> impl Responder {
    println!("Getting configuration");
    let config = &app_data.config;
    HttpResponse::Ok().json(config)
}

async fn reset(app_data: Data<AppData>) -> impl Responder {
    match app_data.status_service.reset().await {
        Ok(_) => HttpResponse::Ok().body("Resetting"),
        Err(e) => HttpResponse::InternalServerError().body(format!("Error resetting: {}", e)),
    }
}


pub fn initialize(config: &mut web::ServiceConfig) {
    config.service(
        web::scope("/app")
            .route("/info", web::get().to(get_configuration))
            .route("/reset", web::get().to(reset))
    );
}