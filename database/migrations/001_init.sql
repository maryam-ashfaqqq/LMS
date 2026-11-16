-- Oakline LMS schema
-- The setup script drops and recreates the configured database, then runs this file.
-- Safe to run on an empty database. It does not contain passwords or card data.

CREATE TABLE users (
  id CHAR(36) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  role ENUM('admin', 'instructor', 'student') NOT NULL DEFAULT 'student',
  avatar_url VARCHAR(500) NULL,
  headline VARCHAR(200) NULL,
  bio TEXT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  last_login_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE categories (
  id CHAR(36) NOT NULL,
  name VARCHAR(120) NOT NULL,
  slug VARCHAR(140) NOT NULL,
  description VARCHAR(500) NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_categories_slug (slug),
  UNIQUE KEY uq_categories_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE courses (
  id CHAR(36) NOT NULL,
  instructor_id CHAR(36) NOT NULL,
  category_id CHAR(36) NOT NULL,
  title VARCHAR(180) NOT NULL,
  slug VARCHAR(200) NOT NULL,
  subtitle VARCHAR(180) NOT NULL DEFAULT '',
  description TEXT NOT NULL,
  thumbnail_url VARCHAR(500) NULL,
  price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  is_free TINYINT(1) NOT NULL DEFAULT 0,
  level ENUM('beginner', 'intermediate', 'advanced') NOT NULL DEFAULT 'beginner',
  language VARCHAR(40) NOT NULL DEFAULT 'English',
  status ENUM('draft', 'pending', 'published', 'rejected') NOT NULL DEFAULT 'draft',
  rejection_reason VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_courses_slug (slug),
  KEY idx_courses_status (status),
  KEY idx_courses_category (category_id),
  KEY idx_courses_instructor (instructor_id),
  CONSTRAINT fk_courses_instructor FOREIGN KEY (instructor_id) REFERENCES users (id),
  CONSTRAINT fk_courses_category FOREIGN KEY (category_id) REFERENCES categories (id),
  CONSTRAINT chk_courses_price CHECK (price >= 0),
  CONSTRAINT chk_courses_free CHECK (is_free = 0 OR price = 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE sections (
  id CHAR(36) NOT NULL,
  course_id CHAR(36) NOT NULL,
  title VARCHAR(180) NOT NULL,
  position INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_sections_course (course_id, position),
  CONSTRAINT fk_sections_course FOREIGN KEY (course_id) REFERENCES courses (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE lessons (
  id CHAR(36) NOT NULL,
  section_id CHAR(36) NOT NULL,
  title VARCHAR(180) NOT NULL,
  content TEXT NOT NULL,
  video_url VARCHAR(500) NULL,
  resource_url VARCHAR(500) NULL,
  duration_minutes INT NOT NULL DEFAULT 0,
  position INT NOT NULL,
  is_preview TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_lessons_section (section_id, position),
  CONSTRAINT fk_lessons_section FOREIGN KEY (section_id) REFERENCES sections (id) ON DELETE CASCADE,
  CONSTRAINT chk_lessons_duration CHECK (duration_minutes >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE enrollments (
  id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  course_id CHAR(36) NOT NULL,
  status ENUM('active', 'completed', 'cancelled') NOT NULL DEFAULT 'active',
  source ENUM('free', 'payment', 'admin_grant') NOT NULL,
  progress_percent DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  enrolled_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_enrollment_user_course (user_id, course_id),
  KEY idx_enrollments_course (course_id),
  KEY idx_enrollments_status (status),
  CONSTRAINT fk_enrollments_user FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT fk_enrollments_course FOREIGN KEY (course_id) REFERENCES courses (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE lesson_progress (
  id CHAR(36) NOT NULL,
  enrollment_id CHAR(36) NOT NULL,
  lesson_id CHAR(36) NOT NULL,
  completed TINYINT(1) NOT NULL DEFAULT 0,
  completed_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_progress_enrollment_lesson (enrollment_id, lesson_id),
  KEY idx_progress_lesson (lesson_id),
  CONSTRAINT fk_progress_enrollment FOREIGN KEY (enrollment_id) REFERENCES enrollments (id) ON DELETE CASCADE,
  CONSTRAINT fk_progress_lesson FOREIGN KEY (lesson_id) REFERENCES lessons (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE reviews (
  id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  course_id CHAR(36) NOT NULL,
  rating TINYINT NOT NULL,
  comment TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_reviews_user_course (user_id, course_id),
  KEY idx_reviews_course (course_id),
  CONSTRAINT chk_reviews_rating CHECK (rating BETWEEN 1 AND 5),
  CONSTRAINT fk_reviews_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_reviews_course FOREIGN KEY (course_id) REFERENCES courses (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Orders and payments store provider references and amounts only.
-- Do not add card number, CVC, or expiry columns.
CREATE TABLE orders (
  id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  course_id CHAR(36) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency CHAR(3) NOT NULL,
  status ENUM('pending', 'paid', 'failed', 'cancelled', 'refunded') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_orders_user (user_id),
  KEY idx_orders_course (course_id),
  KEY idx_orders_status (status),
  CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT fk_orders_course FOREIGN KEY (course_id) REFERENCES courses (id),
  CONSTRAINT chk_orders_amount CHECK (amount >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE payments (
  id CHAR(36) NOT NULL,
  order_id CHAR(36) NOT NULL,
  provider VARCHAR(40) NOT NULL,
  provider_reference VARCHAR(255) NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency CHAR(3) NOT NULL,
  status ENUM('pending', 'succeeded', 'failed', 'cancelled') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_payments_order (order_id),
  KEY idx_payments_reference (provider_reference),
  CONSTRAINT fk_payments_order FOREIGN KEY (order_id) REFERENCES orders (id),
  CONSTRAINT chk_payments_amount CHECK (amount >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE certificates (
  id CHAR(36) NOT NULL,
  enrollment_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  course_id CHAR(36) NOT NULL,
  certificate_code VARCHAR(32) NOT NULL,
  issued_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_certificates_code (certificate_code),
  UNIQUE KEY uq_certificates_enrollment (enrollment_id),
  KEY idx_certificates_user (user_id),
  CONSTRAINT fk_certificates_enrollment FOREIGN KEY (enrollment_id) REFERENCES enrollments (id) ON DELETE CASCADE,
  CONSTRAINT fk_certificates_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_certificates_course FOREIGN KEY (course_id) REFERENCES courses (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE platform_settings (
  setting_key VARCHAR(100) NOT NULL,
  setting_value TEXT NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
