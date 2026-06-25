use anyhow::Result;

/// 将 PTY 子进程绑定到 Job：core 退出时 Windows 自动终止整棵子进程树。
#[cfg(windows)]
pub struct ChildProcessJob {
    handle: windows_sys::Win32::Foundation::HANDLE,
}

#[cfg(windows)]
impl ChildProcessJob {
    pub fn new() -> Result<Self> {
        use windows_sys::Win32::Foundation::CloseHandle;
        use windows_sys::Win32::System::JobObjects::{
            CreateJobObjectW, JobObjectExtendedLimitInformation,
            SetInformationJobObject, JOBOBJECT_EXTENDED_LIMIT_INFORMATION,
            JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
        };

        let handle =
            unsafe { CreateJobObjectW(std::ptr::null(), std::ptr::null()) };
        if handle.is_null() {
            anyhow::bail!("CreateJobObjectW failed");
        }

        let mut info = unsafe { std::mem::zeroed::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() };
        info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;

        let ok = unsafe {
            SetInformationJobObject(
                handle,
                JobObjectExtendedLimitInformation,
                (&raw const info).cast(),
                std::mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
            )
        };
        if ok == 0 {
            unsafe {
                CloseHandle(handle);
            }
            anyhow::bail!("SetInformationJobObject failed");
        }

        Ok(Self { handle })
    }

    pub fn assign_pid(&self, pid: u32) -> Result<()> {
        use windows_sys::Win32::Foundation::CloseHandle;
        use windows_sys::Win32::System::JobObjects::AssignProcessToJobObject;
        use windows_sys::Win32::System::Threading::{
            OpenProcess, PROCESS_SET_QUOTA, PROCESS_TERMINATE,
        };

        let process =
            unsafe { OpenProcess(PROCESS_SET_QUOTA | PROCESS_TERMINATE, 0, pid) };
        if process.is_null() {
            anyhow::bail!("OpenProcess failed for pid {pid}");
        }

        let ok = unsafe { AssignProcessToJobObject(self.handle, process) };
        unsafe {
            CloseHandle(process);
        }
        if ok == 0 {
            anyhow::bail!("AssignProcessToJobObject failed for pid {pid}");
        }
        Ok(())
    }
}

#[cfg(windows)]
unsafe impl Send for ChildProcessJob {}
#[cfg(windows)]
unsafe impl Sync for ChildProcessJob {}

#[cfg(windows)]
impl Drop for ChildProcessJob {
    fn drop(&mut self) {
        use windows_sys::Win32::Foundation::CloseHandle;
        if !self.handle.is_null() {
            unsafe {
                CloseHandle(self.handle);
            }
        }
    }
}

#[cfg(not(windows))]
pub struct ChildProcessJob;

#[cfg(not(windows))]
impl ChildProcessJob {
    pub fn new() -> Result<Self> {
        Ok(Self)
    }

    pub fn assign_pid(&self, _pid: u32) -> Result<()> {
        Ok(())
    }
}

pub fn register_pty_child(
    job: &ChildProcessJob,
    child: &std::sync::Arc<
        std::sync::Mutex<Box<dyn portable_pty::Child + Send + Sync>>,
    >,
) {
    let guard = match child.lock() {
        Ok(guard) => guard,
        Err(_) => return,
    };
    let Some(pid) = guard.process_id() else {
        return;
    };
    drop(guard);
    if let Err(err) = job.assign_pid(pid) {
        tracing::warn!(pid, error = %err, "failed to assign pty child to job");
    } else {
        tracing::debug!(pid, "pty child assigned to kill-on-close job");
    }
}
