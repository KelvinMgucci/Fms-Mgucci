-- =============================================================================
-- Furniture Management System (FMS) -- PostgreSQL Schema
-- Client: Style My Space
-- =============================================================================

-- ---------------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------------

CREATE TYPE user_role AS ENUM (
    'FRONT_DESK',
    'DIRECTOR',
    'OPS_MANAGER',
    'TECHNICIAN',
    'STOCK_KEEPER'
);

CREATE TYPE order_status AS ENUM (
    'PENDING',
    'PRICE_REVIEW',
    'OPS_QUEUE',
    'IN_PRODUCTION',
    'WORKSHOP_COMPLETE',
    'DISPATCHED'
);

CREATE TYPE stage_status AS ENUM (
    'PENDING',
    'ACTIVE',
    'DONE'
);

CREATE TYPE request_status AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED'
);

CREATE TYPE issuance_type AS ENUM (
    'INITIAL',
    'ADDITIONAL'
);

CREATE TYPE showroom_item_status AS ENUM (
    'AVAILABLE',
    'RESERVED',
    'SOLD',
    'TRANSFERRED',
    'BROKEN_OUT'
);

CREATE TYPE sale_order_type AS ENUM (
    'SHOP',
    'CUSTOM'
);

CREATE TYPE transfer_status AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED'
);

CREATE TYPE sms_status AS ENUM (
    'SENT',
    'FAILED'
);

-- ---------------------------------------------------------------------------
-- BRANCHES
-- ---------------------------------------------------------------------------

CREATE TABLE branches_branch (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(100) NOT NULL,
    location        VARCHAR(255) NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- USERS
-- ---------------------------------------------------------------------------

CREATE TABLE users_user (
    id              SERIAL PRIMARY KEY,
    username        VARCHAR(150) NOT NULL UNIQUE,
    email           VARCHAR(254) NOT NULL UNIQUE,
    hashed_password VARCHAR(128) NOT NULL,
    first_name      VARCHAR(150) NOT NULL DEFAULT '',
    last_name       VARCHAR(150) NOT NULL DEFAULT '',
    role            user_role NOT NULL,
    branch_id       INTEGER NOT NULL REFERENCES branches_branch(id) ON DELETE RESTRICT,
    phone_number    VARCHAR(20),
    -- bcrypt hash of PIN; only populated for TECHNICIAN role
    pin_hash        VARCHAR(128),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    is_staff        BOOLEAN NOT NULL DEFAULT FALSE,
    date_joined     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login      TIMESTAMPTZ,

    CONSTRAINT chk_technician_pin CHECK (
        role != 'TECHNICIAN' OR pin_hash IS NOT NULL
    )
);

CREATE INDEX idx_users_branch ON users_user(branch_id);
CREATE INDEX idx_users_role   ON users_user(role);

-- ---------------------------------------------------------------------------
-- ORDERS
-- ---------------------------------------------------------------------------

CREATE TABLE orders_order (
    id                  SERIAL PRIMARY KEY,
    reference_number    VARCHAR(50) NOT NULL UNIQUE,
    branch_id           INTEGER NOT NULL REFERENCES branches_branch(id) ON DELETE RESTRICT,
    created_by_id       INTEGER NOT NULL REFERENCES users_user(id) ON DELETE RESTRICT,
    customer_name       VARCHAR(200) NOT NULL,
    customer_phone      VARCHAR(20) NOT NULL,
    item_description    TEXT NOT NULL,
    quoted_price        NUMERIC(12, 2),
    confirmed_price     NUMERIC(12, 2),
    delivery_date       DATE,
    status              order_status NOT NULL DEFAULT 'PENDING',
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orders_branch  ON orders_order(branch_id);
CREATE INDEX idx_orders_status  ON orders_order(status);
CREATE INDEX idx_orders_created ON orders_order(created_at DESC);

CREATE TABLE orders_orderimage (
    id          SERIAL PRIMARY KEY,
    order_id    INTEGER NOT NULL REFERENCES orders_order(id) ON DELETE CASCADE,
    image_file  VARCHAR(500) NOT NULL,
    uploaded_by_id INTEGER REFERENCES users_user(id) ON DELETE SET NULL,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orderimage_order ON orders_orderimage(order_id);

-- ---------------------------------------------------------------------------
-- PRODUCTION
-- ---------------------------------------------------------------------------

CREATE TABLE production_productionstage (
    id                      SERIAL PRIMARY KEY,
    order_id                INTEGER NOT NULL REFERENCES orders_order(id) ON DELETE CASCADE,
    stage_name              VARCHAR(200) NOT NULL,
    sequence_number         SMALLINT NOT NULL,
    assigned_technician_id  INTEGER REFERENCES users_user(id) ON DELETE SET NULL,
    status                  stage_status NOT NULL DEFAULT 'PENDING',
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    activated_at            TIMESTAMPTZ,
    completed_at            TIMESTAMPTZ,

    CONSTRAINT uq_stage_sequence UNIQUE (order_id, sequence_number),
    CONSTRAINT chk_stage_sequence_positive CHECK (sequence_number > 0)
);

CREATE INDEX idx_stage_order       ON production_productionstage(order_id);
CREATE INDEX idx_stage_technician  ON production_productionstage(assigned_technician_id);
CREATE INDEX idx_stage_status      ON production_productionstage(status);

-- ---------------------------------------------------------------------------
-- STOCK
-- ---------------------------------------------------------------------------

CREATE TABLE stock_inventoryitem (
    id                  SERIAL PRIMARY KEY,
    name                VARCHAR(200) NOT NULL,
    unit                VARCHAR(50) NOT NULL,
    current_quantity    NUMERIC(12, 3) NOT NULL DEFAULT 0,
    minimum_threshold   NUMERIC(12, 3) NOT NULL DEFAULT 0,
    last_updated        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_inventory_quantity CHECK (current_quantity >= 0),
    CONSTRAINT chk_inventory_threshold CHECK (minimum_threshold >= 0)
);

CREATE TABLE stock_materialestimate (
    id                  SERIAL PRIMARY KEY,
    stage_id            INTEGER NOT NULL REFERENCES production_productionstage(id) ON DELETE CASCADE,
    inventory_item_id   INTEGER REFERENCES stock_inventoryitem(id) ON DELETE SET NULL,
    material_name       VARCHAR(200) NOT NULL,
    estimated_quantity  NUMERIC(12, 3) NOT NULL,
    unit                VARCHAR(50) NOT NULL,

    CONSTRAINT chk_estimate_quantity CHECK (estimated_quantity > 0)
);

CREATE INDEX idx_materialestimate_stage ON stock_materialestimate(stage_id);

CREATE TABLE stock_materialrequest (
    id              SERIAL PRIMARY KEY,
    stage_id        INTEGER NOT NULL REFERENCES production_productionstage(id) ON DELETE CASCADE,
    requested_by_id INTEGER NOT NULL REFERENCES users_user(id) ON DELETE RESTRICT,
    material_name   VARCHAR(200) NOT NULL,
    quantity        NUMERIC(12, 3) NOT NULL,
    unit            VARCHAR(50) NOT NULL,
    status          request_status NOT NULL DEFAULT 'PENDING',
    reviewed_by_id  INTEGER REFERENCES users_user(id) ON DELETE SET NULL,
    review_reason   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at     TIMESTAMPTZ,

    CONSTRAINT chk_request_quantity CHECK (quantity > 0)
);

CREATE INDEX idx_materialrequest_stage  ON stock_materialrequest(stage_id);
CREATE INDEX idx_materialrequest_status ON stock_materialrequest(status);

CREATE TABLE stock_issuance (
    id                  SERIAL PRIMARY KEY,
    order_id            INTEGER NOT NULL REFERENCES orders_order(id) ON DELETE RESTRICT,
    stage_id            INTEGER REFERENCES production_productionstage(id) ON DELETE SET NULL,
    inventory_item_id   INTEGER NOT NULL REFERENCES stock_inventoryitem(id) ON DELETE RESTRICT,
    quantity_issued     NUMERIC(12, 3) NOT NULL,
    issued_by_id        INTEGER NOT NULL REFERENCES users_user(id) ON DELETE RESTRICT,
    issuance_type       issuance_type NOT NULL DEFAULT 'INITIAL',
    issued_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_issuance_quantity CHECK (quantity_issued > 0)
);

CREATE INDEX idx_issuance_order ON stock_issuance(order_id);
CREATE INDEX idx_issuance_item  ON stock_issuance(inventory_item_id);

-- ---------------------------------------------------------------------------
-- SHOP
-- ---------------------------------------------------------------------------

CREATE TABLE shop_showroomitem (
    id              SERIAL PRIMARY KEY,
    sku             VARCHAR(100) NOT NULL,
    name            VARCHAR(200) NOT NULL,
    branch_id       INTEGER NOT NULL REFERENCES branches_branch(id) ON DELETE RESTRICT,
    category        VARCHAR(100),
    price           NUMERIC(12, 2) NOT NULL,
    status          showroom_item_status NOT NULL DEFAULT 'AVAILABLE',
    -- Self-referential FK: component items point to their parent set
    parent_set_id   INTEGER REFERENCES shop_showroomitem(id) ON DELETE SET NULL,
    is_set          BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_sku_branch UNIQUE (sku, branch_id),
    CONSTRAINT chk_item_price CHECK (price >= 0),
    CONSTRAINT chk_no_self_parent CHECK (parent_set_id != id)
);

CREATE INDEX idx_showroomitem_branch    ON shop_showroomitem(branch_id);
CREATE INDEX idx_showroomitem_status    ON shop_showroomitem(status);
CREATE INDEX idx_showroomitem_sku       ON shop_showroomitem(sku);
CREATE INDEX idx_showroomitem_parentset ON shop_showroomitem(parent_set_id);

CREATE TABLE shop_reservation (
    id              SERIAL PRIMARY KEY,
    item_id         INTEGER NOT NULL REFERENCES shop_showroomitem(id) ON DELETE RESTRICT,
    customer_name   VARCHAR(200) NOT NULL,
    customer_phone  VARCHAR(20) NOT NULL,
    deposit_amount  NUMERIC(12, 2) NOT NULL DEFAULT 0,
    expiry_date     DATE NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_by_id   INTEGER NOT NULL REFERENCES users_user(id) ON DELETE RESTRICT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_deposit CHECK (deposit_amount >= 0)
);

CREATE INDEX idx_reservation_item ON shop_reservation(item_id);
CREATE INDEX idx_reservation_active ON shop_reservation(is_active) WHERE is_active = TRUE;

CREATE TABLE shop_sale (
    id              SERIAL PRIMARY KEY,
    item_id         INTEGER NOT NULL REFERENCES shop_showroomitem(id) ON DELETE RESTRICT,
    branch_id       INTEGER NOT NULL REFERENCES branches_branch(id) ON DELETE RESTRICT,
    -- Nullable: links to a custom order when order_type = CUSTOM
    order_id        INTEGER REFERENCES orders_order(id) ON DELETE SET NULL,
    sale_price      NUMERIC(12, 2) NOT NULL,
    sold_by_id      INTEGER NOT NULL REFERENCES users_user(id) ON DELETE RESTRICT,
    order_type      sale_order_type NOT NULL DEFAULT 'SHOP',
    sold_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_sale_price CHECK (sale_price >= 0)
);

CREATE INDEX idx_sale_branch ON shop_sale(branch_id);
CREATE INDEX idx_sale_sold_at ON shop_sale(sold_at DESC);

CREATE TABLE shop_branchtransferrequest (
    id              SERIAL PRIMARY KEY,
    item_id         INTEGER NOT NULL REFERENCES shop_showroomitem(id) ON DELETE RESTRICT,
    from_branch_id  INTEGER NOT NULL REFERENCES branches_branch(id) ON DELETE RESTRICT,
    to_branch_id    INTEGER NOT NULL REFERENCES branches_branch(id) ON DELETE RESTRICT,
    requested_by_id INTEGER NOT NULL REFERENCES users_user(id) ON DELETE RESTRICT,
    status          transfer_status NOT NULL DEFAULT 'PENDING',
    reviewed_by_id  INTEGER REFERENCES users_user(id) ON DELETE SET NULL,
    review_notes    TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at     TIMESTAMPTZ,

    CONSTRAINT chk_transfer_branches CHECK (from_branch_id != to_branch_id)
);

CREATE INDEX idx_transfer_status ON shop_branchtransferrequest(status);
CREATE INDEX idx_transfer_item   ON shop_branchtransferrequest(item_id);

-- ---------------------------------------------------------------------------
-- NOTIFICATIONS
-- ---------------------------------------------------------------------------

CREATE TABLE notifications_smslog (
    id                  SERIAL PRIMARY KEY,
    recipient_phone     VARCHAR(20) NOT NULL,
    message_body        TEXT NOT NULL,
    trigger_event       VARCHAR(100) NOT NULL,
    status              sms_status NOT NULL,
    gateway_response    TEXT,
    sent_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_smslog_status  ON notifications_smslog(status);
CREATE INDEX idx_smslog_sent_at ON notifications_smslog(sent_at DESC);

-- ---------------------------------------------------------------------------
-- UPDATED_AT TRIGGER (auto-update orders_order.updated_at)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_orders_updated_at
    BEFORE UPDATE ON orders_order
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- DJANGO MIGRATIONS TABLE (required if running alongside Django ORM)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS django_migrations (
    id          SERIAL PRIMARY KEY,
    app         VARCHAR(255) NOT NULL,
    name        VARCHAR(255) NOT NULL,
    applied     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
