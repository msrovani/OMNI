/*
 * IEC 61850-9-2LE — Sampled Values (SV) Publisher
 *
 * Implementa o perfil "Sampled Values" conforme IEC 61850-9-2LE
 * para publicação de medições de tensão, corrente e frequência
 * em tempo real via Ethernet (802.1Q VLAN opcional).
 *
 * Frame ASN.1 BER codificado:
 *   - savPdu (APDU) com 4 canais: V1, V2, V3, I1
 *   - Taxa: 80 amostras/ciclo (4800 Hz @ 60 Hz)
 *   - smpSynch: 2 (global)
 */

#include <Arduino.h>
#include <esp_eth.h>
#include <esp_netif.h>
#include <lwip/sockets.h>
#include <string.h>

// ─── SV Configuration ───

#define SV_MULTICAST_IP    "01:0C:CD:04:00:01"   // IEC 61850 SV MAC
#define SV_MULTICAST_ADDR  "224.0.0.181"         // IEC 61850 SV IP
#define SV_PORT            6000                  // IEC 61850 SV port
#define SV_VLAN_ID         0                     // No VLAN
#define SV_SAMPLES_PER_SEC 4800                  // 80 samples/cycle @ 60Hz
#define SV_ASDU_COUNT      1                     // 1 ASDU per frame

// SV frame structure (simplified ASN.1)
typedef struct __attribute__((packed)) {
    uint8_t  appid_hi;           // 0x40
    uint8_t  appid_lo;           // 0x00
    uint16_t length;
    uint16_t reserved1;
    uint16_t reserved2;
    // ASN.1 savPdu
    uint8_t  tag_savPdu;         // 0x60 (APPLICATION 0)
    uint8_t  len_savPdu;
    uint8_t  tag_noASDU;         // 0xA2 (CONTEXT [2])
    uint8_t  len_noASDU;
    uint8_t  tag_ASDU;           // 0x30 (SEQUENCE)
    uint8_t  len_ASDU;
    // ASDU content
    uint8_t  svID[8];            // 8-byte SV ID string
    uint32_t smpCnt;             // Sample counter
    uint32_t confRev;            // Configuration revision
    uint8_t  smpSynch;           // 0=local, 1=global, 2=global+GPS
    // 4 channels: V1, V2, V3, I1 (float32 each = 16 bytes)
    float    instV1;
    float    instV2;
    float    instV3;
    float    instI1;
    uint8_t  padding[4];         // Align to 32 bytes
} sv_frame_t;

static int sv_sock = -1;
static uint32_t sample_counter = 0;
static uint32_t last_sample_us = 0;
static const uint32_t sample_interval_us = 1000000 / SV_SAMPLES_PER_SEC;  // ~208 us

// ─── Initialise SV publisher socket ───

void svInit() {
    sv_sock = socket(AF_INET, SOCK_DGRAM, IPPROTO_UDP);
    if (sv_sock < 0) {
        Serial.println("[SV] Socket creation failed");
        return;
    }

    // Allow multicast
    int opt = 1;
    setsockopt(sv_sock, IPPROTO_IP, IP_MULTICAST_LOOP, &opt, sizeof(opt));

    // Bind
    struct sockaddr_in addr;
    memset(&addr, 0, sizeof(addr));
    addr.sin_family = AF_INET;
    addr.sin_port = htons(SV_PORT);
    addr.sin_addr.s_addr = INADDR_ANY;
    bind(sv_sock, (struct sockaddr*)&addr, sizeof(addr));

    // Join multicast
    struct ip_mreq mreq;
    mreq.imr_multiaddr.s_addr = inet_addr(SV_MULTICAST_ADDR);
    mreq.imr_interface.s_addr = INADDR_ANY;
    setsockopt(sv_sock, IPPROTO_IP, IP_ADD_MEMBERSHIP, &mreq, sizeof(mreq));

    Serial.printf("[SV] IEC 61850-9-2LE initialised on port %d (%d samples/s)\n",
                  SV_PORT, SV_SAMPLES_PER_SEC);
}

// ─── Publish a single SV frame ───

void svPublish(float v1, float v2, float v3, float i1) {
    if (sv_sock < 0) return;

    // Rate limiting: wait for sample interval
    uint32_t now = micros();
    uint32_t elapsed = now - last_sample_us;
    if (elapsed < sample_interval_us) return;
    last_sample_us = now;

    sample_counter++;

    sv_frame_t frame;
    memset(&frame, 0, sizeof(frame));
    frame.appid_hi = 0x40;
    frame.appid_lo = 0x00;
    frame.length = htons(sizeof(frame) - 4);  // Length after reserved2
    frame.reserved1 = 0;
    frame.reserved2 = 0;

    // ASN.1 savPdu
    frame.tag_savPdu = 0x60;
    frame.len_savPdu = sizeof(frame) - 8;
    frame.tag_noASDU = 0xA2;
    frame.len_noASDU = frame.len_savPdu - 2;
    frame.tag_ASDU = 0x30;
    frame.len_ASDU = frame.len_noASDU - 2;

    // SV ID (8 bytes, zero-padded)
    memcpy(frame.svID, "OMNI-BOX", 8);

    // Sample counter (rolls over at 4800*60 = 288000)
    frame.smpCnt = htonl(sample_counter);
    frame.confRev = htonl(1);
    frame.smpSynch = 2;  // GPS-synchronized

    // Voltage in kV, current in A (float32)
    frame.instV1 = v1;
    frame.instV2 = v2;
    frame.instV3 = v3;
    frame.instI1 = i1;

    // Send to multicast
    struct sockaddr_in dest;
    memset(&dest, 0, sizeof(dest));
    dest.sin_family = AF_INET;
    dest.sin_port = htons(SV_PORT);
    dest.sin_addr.s_addr = inet_addr(SV_MULTICAST_ADDR);

    int sent = sendto(sv_sock, &frame, sizeof(frame), 0,
                      (struct sockaddr*)&dest, sizeof(dest));
    if (sent < 0) {
        Serial.println("[SV] Send failed");
    }
}

// ─── Get current sample counter ───

uint32_t svGetSampleCount() {
    return sample_counter;
}
