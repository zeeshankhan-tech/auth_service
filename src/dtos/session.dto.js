class SessionDto {
  static fromEntity(row) {
    return {
      jti: row.jti,
      familyId: row.familyId,
      deviceInfo: row.deviceInfo || '',
      expiresAt: row.expiresAt,
      createdAt: row.createdAt,
    };
  }
}

class SessionsListDto {
  static fromService(rows) {
    return {
      sessions: rows.map((r) => SessionDto.fromEntity(r)),
    };
  }
}

module.exports = { SessionDto, SessionsListDto };
