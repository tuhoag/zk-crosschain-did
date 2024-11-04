use actix_web::{web::{self, Data}, HttpResponse, Responder};

use crate::{models::status_state::StatusType, utils::AppData};


async fn revoke(status_type: web::Path<StatusType>, id: web::Path<u64>, app_data: Data<AppData>) -> impl Responder {
    let service = &app_data.status_service;
    let mut last_status = service.get_latest_status(*status_type).await.unwrap();
    last_status.revoke_credential(*id);

    match service.insert_one(&last_status).await {
        Ok(_) => HttpResponse::Ok().body(format!("Revoking vc with id: {}", id)),
        Err(e) => return HttpResponse::InternalServerError().body(format!("Error revoking credential: {}", e)),
    }
}

pub fn initialize(config: &mut web::ServiceConfig) {
    config.service(
        web::scope("/credentials/{status_type}")
            .route("/{id}/revoke", web::delete().to(revoke)),
    );
}