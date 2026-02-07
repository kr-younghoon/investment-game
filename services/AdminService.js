import bcrypt from 'bcryptjs';

/**
 * AdminService - 관리자 계정 관리
 */
export class AdminService {
  constructor(dbHelpers) {
    this.db = dbHelpers;
  }

  /**
   * 관리자 인증
   */
  authenticate(adminId, password) {
    try {
      const admin = this.db.getAdmin(adminId);

      if (!admin) {
        return { success: false, error: '관리자 ID를 찾을 수 없습니다.' };
      }

      // bcrypt 해시 비교 (평문 폴백: 마이그레이션 전 계정 대응)
      const isMatch = admin.password.startsWith('$2')
        ? bcrypt.compareSync(password, admin.password)
        : admin.password === password;
      if (!isMatch) {
        return { success: false, error: '비밀번호가 일치하지 않습니다.' };
      }

      return {
        success: true,
        admin: {
          id: admin.id,
          adminId: admin.admin_id,
        },
      };
    } catch (error) {
      console.error('[AdminService] 인증 오류:', error);
      return { success: false, error: '인증 중 오류가 발생했습니다.' };
    }
  }

  /**
   * 모든 관리자 목록 조회
   */
  getAllAdmins() {
    try {
      const admins = this.db.getAllAdmins();
      return admins.map((admin) => ({
        id: admin.id,
        adminId: admin.admin_id,
        createdAt: admin.created_at,
        updatedAt: admin.updated_at,
      }));
    } catch (error) {
      console.error('[AdminService] 목록 조회 오류:', error);
      return [];
    }
  }

  /**
   * 관리자 계정 생성
   */
  createAdmin(adminId, password) {
    if (!adminId || !password) {
      return { success: false, error: '관리자 ID와 비밀번호를 입력해주세요.' };
    }

    try {
      // 중복 확인
      const existing = this.db.getAdmin(adminId);
      if (existing) {
        return { success: false, error: '이미 존재하는 관리자 ID입니다.' };
      }

      const hashedPassword = bcrypt.hashSync(password, 10);
      const result = this.db.createAdmin(adminId, hashedPassword);
      return {
        success: true,
        admin: {
          id: result.id,
          adminId: adminId,
        },
      };
    } catch (error) {
      console.error('[AdminService] 계정 생성 오류:', error);
      return { success: false, error: '계정 생성 중 오류가 발생했습니다.' };
    }
  }

  /**
   * 관리자 비밀번호 변경
   */
  updatePassword(adminId, newPassword) {
    if (!newPassword) {
      return { success: false, error: '새 비밀번호를 입력해주세요.' };
    }

    try {
      const hashedPassword = bcrypt.hashSync(newPassword, 10);
      const result = this.db.updateAdminPassword(adminId, hashedPassword);
      if (result.changes > 0) {
        return { success: true };
      }
      return { success: false, error: '관리자를 찾을 수 없습니다.' };
    } catch (error) {
      console.error('[AdminService] 비밀번호 변경 오류:', error);
      return { success: false, error: '비밀번호 변경 중 오류가 발생했습니다.' };
    }
  }

  /**
   * 관리자 계정 삭제
   */
  deleteAdmin(adminId, currentAdminId = null) {
    // 자기 자신 삭제 방지
    if (adminId === currentAdminId) {
      return { success: false, error: '자기 자신은 삭제할 수 없습니다.' };
    }

    try {
      const result = this.db.deleteAdmin(adminId);
      if (result.changes > 0) {
        return { success: true };
      }
      return { success: false, error: '관리자를 찾을 수 없습니다.' };
    } catch (error) {
      console.error('[AdminService] 계정 삭제 오류:', error);
      return { success: false, error: '계정 삭제 중 오류가 발생했습니다.' };
    }
  }
}

export default AdminService;
