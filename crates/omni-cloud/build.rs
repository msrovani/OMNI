fn main() -> Result<(), Box<dyn std::error::Error>> {
    tonic_build::configure()
        .build_server(true)
        .build_client(true)
        .compile_protos(
            &["proto/edge/v1/edge.proto", "proto/common/v1/common.proto"],
            &["proto"],
        )?;
    Ok(())
}
