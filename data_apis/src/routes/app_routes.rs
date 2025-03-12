use actix_web::{web::{self, Data, Json}, Responder};

use crate::{errors::ApiResult, utils::AppData};

async fn get_configuration(app_data: Data<AppData>) -> ApiResult<impl Responder> {
    println!("Getting configuration");
    let config = &app_data.config;
    Ok(Json(config.clone()))
}

async fn reset(app_data: Data<AppData>) -> ApiResult<impl Responder> {
    let status_service = &app_data.status_service;
    let credential_service = &app_data.credential_service;

    credential_service.reset().await?;
    status_service.reset().await?;

    Ok(Json("Reset credentials and status"))
}


pub fn initialize(config: &mut web::ServiceConfig) {
    config.service(
        web::scope("/app")
            .route("/info", web::get().to(get_configuration))
            .route("/reset", web::get().to(reset))
    );
}