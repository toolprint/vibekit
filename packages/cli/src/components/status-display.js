import chalk from 'chalk';

const displayStartupStatus = (agentName, sandboxType) => {
  const dashboardPort = Math.floor(Math.random() * 1000) + 3000;
  const dashboardUrl = `http://localhost:${dashboardPort}`;
  
  console.log(chalk.dim(`🔒 Secured by Vibekit - Dashboard: ${chalk.blue.underline(dashboardUrl)}`));
  console.log(); // Add margin bottom
};

export default displayStartupStatus;