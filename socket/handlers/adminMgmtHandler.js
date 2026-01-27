/**
 * Admin Management Handler - 관리자 계정 관리 핸들러
 */
export function registerAdminMgmtHandlers(socket, io, services) {
  const { stateManager, adminService } = services;

  // 관리자 목록 조회
  socket.on('ADMIN_GET_ADMINS', (callback) => {
    if (!stateManager.isAdmin(socket)) return;

    const admins = adminService.getAllAdmins();
    if (callback) {
      callback({ success: true, admins });
    }
  });

  // 관리자 계정 생성
  socket.on('ADMIN_CREATE_ADMIN', (data, callback) => {
    if (!stateManager.isAdmin(socket)) return;

    const { adminId, password } = data;
    const result = adminService.createAdmin(adminId, password);

    if (callback) {
      callback(result);
    }

    if (result.success) {
      console.log(`[ADMIN_CREATE_ADMIN] 관리자 생성: ${adminId}`);
    }
  });

  // 관리자 비밀번호 변경
  socket.on('ADMIN_UPDATE_ADMIN_PASSWORD', (data, callback) => {
    if (!stateManager.isAdmin(socket)) return;

    const { adminId, newPassword } = data;
    const result = adminService.updatePassword(adminId, newPassword);

    if (callback) {
      callback(result);
    }

    if (result.success) {
      console.log(`[ADMIN_UPDATE_ADMIN_PASSWORD] 비밀번호 변경: ${adminId}`);
    }
  });

  // 관리자 계정 삭제
  socket.on('ADMIN_DELETE_ADMIN', (data, callback) => {
    if (!stateManager.isAdmin(socket)) return;

    const { adminId } = data;
    const currentAdminId = stateManager.getAdminId(socket.id);
    const result = adminService.deleteAdmin(adminId, currentAdminId);

    if (callback) {
      callback(result);
    }

    if (result.success) {
      console.log(`[ADMIN_DELETE_ADMIN] 관리자 삭제: ${adminId}`);
    }
  });
}

export default registerAdminMgmtHandlers;
