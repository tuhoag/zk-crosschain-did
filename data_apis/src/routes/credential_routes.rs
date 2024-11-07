use actix_web::{web::{self, Data, Json}, Responder};

use crate::{errors::AppResult, models::{request_params::CredentialIssuanceParams, status_state::StatusMechanism}, utils::AppData};

async fn issue(status_mechanism: web::Path<StatusMechanism>, issuance_params: web::Json<CredentialIssuanceParams>, app_data: Data<AppData>) -> AppResult<impl Responder> {
    let credential_service = &app_data.credential_service;
    let status_service = &app_data.status_service;

    let credential = credential_service.issue_credential(&issuance_params.into_inner(), &status_mechanism, status_service, &app_data.config).await?;
    Ok(Json(credential))
}

async fn revoke(params: web::Path<(StatusMechanism, String)>, app_data: Data<AppData>) -> AppResult<impl Responder> {
    let credential_service = &app_data.credential_service;
    let status_service = &app_data.status_service;
    let (status_mechanism, id) = params.into_inner();
    let credential = credential_service.revoke_credential(&id, &status_mechanism, status_service).await?;
    Ok(Json(credential))
}

async fn get_credential(params: web::Path<(StatusMechanism, String)>, app_data: Data<AppData>) ->  AppResult<impl Responder> {
    let service = &app_data.credential_service;
    let (status_mechanism, id) = params.into_inner();

    let credential = service.get_credential_by_id(&status_mechanism, &id).await?;
    Ok(Json(credential))
}

async fn get_all_credentials(status_mechanism: web::Path<StatusMechanism>, app_data: Data<AppData>) -> AppResult<impl Responder> {
    let service = &app_data.credential_service;

    let credentials = service.get_all_credentials(*status_mechanism).await?;
    Ok(Json(credentials))
}

pub fn initialize(config: &mut web::ServiceConfig) {
    config.service(
        web::scope("/credentials/{status_mechanism}")
            .route("/{id}", web::delete().to(revoke))
            .route("", web::post().to(issue))
            .route("/{id}", web::get().to(get_credential))
            .route("", web::get().to(get_all_credentials))
    );
}