import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';

class Filesystem {
  constructor(projectRoot, logger) {
    this.projectRoot = projectRoot;
    this.logger = logger;
    this.sandboxRoot = path.join(projectRoot, '.vibekit', '.vibekit-sandbox');
    this.workspaceDir = path.join(this.sandboxRoot, 'workspace');
    this.backupDir = path.join(this.sandboxRoot, 'backups');
  }

  async initialize() {
    await this.logger.log('info', 'Initializing sandbox environment');
    
    await fs.ensureDir(this.sandboxRoot);
    await fs.ensureDir(this.workspaceDir);
    await fs.ensureDir(this.backupDir);

    await this.createWorkspaceCopy();
    await this.createSandboxConfig();
  }

  async createWorkspaceCopy() {
    const importantFiles = [
      'package.json',
      'package-lock.json',
      'yarn.lock',
      'tsconfig.json',
      '.gitignore',
      '.env.example',
      'README.md'
    ];

    const importantDirs = [
      'src',
      'lib',
      'components',
      'pages',
      'api',
      'utils',
      'config',
      'public',
      'assets'
    ];

    for (const file of importantFiles) {
      const srcPath = path.join(this.projectRoot, file);
      const destPath = path.join(this.workspaceDir, file);
      
      if (await fs.pathExists(srcPath)) {
        await fs.copy(srcPath, destPath);
        await this.logger.log('debug', `Copied ${file} to sandbox`);
      }
    }

    for (const dir of importantDirs) {
      const srcPath = path.join(this.projectRoot, dir);
      const destPath = path.join(this.workspaceDir, dir);
      
      if (await fs.pathExists(srcPath)) {
        await fs.copy(srcPath, destPath);
        await this.logger.log('debug', `Copied ${dir}/ to sandbox`);
      }
    }

    const gitPath = path.join(this.projectRoot, '.git');
    const destGitPath = path.join(this.workspaceDir, '.git');
    
    if (await fs.pathExists(gitPath)) {
      await fs.copy(gitPath, destGitPath);
      await this.logger.log('debug', 'Copied .git to sandbox');
    }
  }

  async createSandboxConfig() {
    const config = {
      created: new Date().toISOString(),
      projectRoot: this.projectRoot,
      restrictions: {
        networkAccess: true,
        fileSystemWrite: true,
        processExecution: true,
        maxFileSize: '10MB',
        allowedExtensions: ['.js', '.ts', '.json', '.md', '.yml', '.yaml', '.txt', '.py', '.go', '.rs']
      },
      monitoring: {
        logCommands: true,
        logFileChanges: true,
        logNetworkRequests: false
      }
    };

    const configPath = path.join(this.sandboxRoot, 'sandbox-config.json');
    await fs.writeFile(configPath, JSON.stringify(config, null, 2));
  }

  async createBackup(description = 'Auto backup') {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(this.backupDir, `backup-${timestamp}`);
    
    await fs.copy(this.workspaceDir, backupPath);
    
    const metadataPath = path.join(backupPath, '.backup-metadata.json');
    await fs.writeFile(metadataPath, JSON.stringify({
      created: new Date().toISOString(),
      description,
      originalPath: this.workspaceDir
    }, null, 2));

    await this.logger.log('info', `Created backup: ${description}`, { backupPath });
    
    return backupPath;
  }

  async restoreFromBackup(backupName) {
    const backupPath = path.join(this.backupDir, backupName);
    
    if (!await fs.pathExists(backupPath)) {
      throw new Error(`Backup ${backupName} not found`);
    }

    await fs.remove(this.workspaceDir);
    await fs.copy(backupPath, this.workspaceDir);
    
    const metadataPath = path.join(this.workspaceDir, '.backup-metadata.json');
    if (await fs.pathExists(metadataPath)) {
      await fs.remove(metadataPath);
    }

    await this.logger.log('info', `Restored from backup: ${backupName}`);
  }

  async syncChangesBack() {
    const changedFiles = await this.detectChanges();
    
    if (changedFiles.length === 0) {
      await this.logger.log('info', 'No changes detected in sandbox');
      return [];
    }

    await this.logger.log('info', `Syncing ${changedFiles.length} changed files back to project`);

    for (const file of changedFiles) {
      const sandboxFile = path.join(this.workspaceDir, file);
      const projectFile = path.join(this.projectRoot, file);
      
      if (await fs.pathExists(sandboxFile)) {
        await fs.ensureDir(path.dirname(projectFile));
        await fs.copy(sandboxFile, projectFile);
        await this.logger.log('debug', `Synced ${file} back to project`);
      }
    }

    return changedFiles;
  }

  async detectChanges() {
    const changes = [];
    
    const walkDir = async (dir, relativePath = '') => {
      const items = await fs.readdir(dir);
      
      for (const item of items) {
        if (item.startsWith('.') && item !== '.gitignore') continue;
        
        const itemPath = path.join(dir, item);
        const relativeItemPath = path.join(relativePath, item);
        const stat = await fs.stat(itemPath);
        
        if (stat.isDirectory()) {
          await walkDir(itemPath, relativeItemPath);
        } else {
          const projectFile = path.join(this.projectRoot, relativeItemPath);
          
          if (!await fs.pathExists(projectFile)) {
            changes.push(relativeItemPath);
          } else {
            const sandboxContent = await fs.readFile(itemPath, 'utf8');
            const projectContent = await fs.readFile(projectFile, 'utf8');
            
            if (sandboxContent !== projectContent) {
              changes.push(relativeItemPath);
            }
          }
        }
      }
    };

    await walkDir(this.workspaceDir);
    return changes;
  }

  async cleanup() {
    await this.logger.log('info', 'Cleaning up sandbox environment');
    
    if (await fs.pathExists(this.sandboxRoot)) {
      await fs.remove(this.sandboxRoot);
    }
  }

  getWorkspacePath() {
    return this.workspaceDir;
  }

  async listBackups() {
    if (!await fs.pathExists(this.backupDir)) {
      return [];
    }

    const backups = await fs.readdir(this.backupDir);
    const backupInfo = [];

    for (const backup of backups) {
      const metadataPath = path.join(this.backupDir, backup, '.backup-metadata.json');
      
      if (await fs.pathExists(metadataPath)) {
        const metadata = await fs.readJson(metadataPath);
        backupInfo.push({
          name: backup,
          ...metadata
        });
      } else {
        const stat = await fs.stat(path.join(this.backupDir, backup));
        backupInfo.push({
          name: backup,
          created: stat.birthtime.toISOString(),
          description: 'No description available'
        });
      }
    }

    return backupInfo.sort((a, b) => new Date(b.created) - new Date(a.created));
  }
}

export default Filesystem;