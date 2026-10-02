package auth

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrUserNotFound      = errors.New("user not found")
	ErrUserAlreadyExists = errors.New("shop owner already set up")
)

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

func (r *Repository) HasAnyUser(ctx context.Context) (bool, error) {
	var count int
	err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM users`).Scan(&count)
	return count > 0, err
}

func (r *Repository) Create(ctx context.Context, name, email, phone, passwordHash string) (User, error) {
	var user User
	err := r.db.QueryRow(ctx, `
		INSERT INTO users (name, email, phone, password_hash)
		VALUES ($1, $2, $3, $4)
		RETURNING id, name, email, COALESCE(phone, ''), created_at, updated_at
	`, name, email, phone, passwordHash).Scan(
		&user.ID,
		&user.Name,
		&user.Email,
		&user.Phone,
		&user.CreatedAt,
		&user.UpdatedAt,
	)
	if err != nil {
		return User{}, err
	}
	return user, nil
}

func (r *Repository) GetByEmail(ctx context.Context, email string) (User, string, error) {
	var user User
	var passwordHash string

	err := r.db.QueryRow(ctx, `
		SELECT id, name, email, COALESCE(phone, ''), password_hash, created_at, updated_at
		FROM users
		WHERE email = $1
	`, email).Scan(
		&user.ID,
		&user.Name,
		&user.Email,
		&user.Phone,
		&passwordHash,
		&user.CreatedAt,
		&user.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return User{}, "", ErrUserNotFound
	}
	if err != nil {
		return User{}, "", err
	}
	return user, passwordHash, nil
}

func (r *Repository) GetByID(ctx context.Context, userID string) (User, error) {
	var user User
	err := r.db.QueryRow(ctx, `
		SELECT id, name, email, COALESCE(phone, ''), created_at, updated_at
		FROM users
		WHERE id = $1
	`, userID).Scan(
		&user.ID,
		&user.Name,
		&user.Email,
		&user.Phone,
		&user.CreatedAt,
		&user.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return User{}, ErrUserNotFound
	}
	return user, err
}

func (r *Repository) UpdateProfile(ctx context.Context, userID, name, phone string) (User, error) {
	var user User
	err := r.db.QueryRow(ctx, `
		UPDATE users
		SET name = $2, phone = $3, updated_at = $4
		WHERE id = $1
		RETURNING id, name, email, COALESCE(phone, ''), created_at, updated_at
	`, userID, name, phone, time.Now()).Scan(
		&user.ID,
		&user.Name,
		&user.Email,
		&user.Phone,
		&user.CreatedAt,
		&user.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return User{}, ErrUserNotFound
	}
	return user, err
}

func (r *Repository) UpdatePassword(ctx context.Context, userID, passwordHash string) error {
	result, err := r.db.Exec(ctx, `
		UPDATE users
		SET password_hash = $2, updated_at = now()
		WHERE id = $1
	`, userID, passwordHash)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return ErrUserNotFound
	}
	return nil
}
