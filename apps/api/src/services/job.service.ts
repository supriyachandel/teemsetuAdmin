import { prisma } from '../config/database';
import axios from 'axios';

export class JobService {
  async getJobs(companyId: string) {
    return prisma.jobPosting.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createJob(companyId: string, data: any) {
    const { title, description, technicality, hrContact } = data;
    
    // 1. Create the job in the database
    const job = await prisma.jobPosting.create({
      data: {
        companyId,
        title,
        description,
        technicality,
        hrContact,
        status: 'DRAFT',
      },
    });

    // 2. Fetch the company's LinkedIn credentials
    const settings = await prisma.companySettings.findUnique({
      where: { companyId },
    });

    if (settings?.linkedinToken) {
      // Automate posting to LinkedIn if token exists
      try {
        const postUrl = await this.publishToLinkedIn(settings.linkedinToken, job);
        
        // Update job status to PUBLISHED
        return await prisma.jobPosting.update({
          where: { id: job.id },
          data: {
            status: 'PUBLISHED',
            linkedinPostUrl: postUrl,
          },
        });
      } catch (error: any) {
        console.error('LinkedIn API Error:', error.response?.data || error.message);
        // Keep as draft if it failed, or mark as FAILED
        return await prisma.jobPosting.update({
          where: { id: job.id },
          data: { status: 'FAILED' },
        });
      }
    }

    return job;
  }

  async publishToLinkedIn(accessToken: string, job: any) {
    // 1. Get the user's LinkedIn profile URN
    const profileRes = await axios.get('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    
    const authorUrn = `urn:li:person:${profileRes.data.sub}`;
    
    // 2. Format the job posting text
    const text = `🚀 **We are Hiring!**\n\n**${job.title}**\n\n${job.description}\n\n**Technical Skills Required:**\n${job.technicality.join(', ')}\n\nContact HR: ${job.hrContact}`;

    // 3. Post to LinkedIn
    const postRes = await axios.post(
      'https://api.linkedin.com/v2/ugcPosts',
      {
        author: authorUrn,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: { text },
            shareMediaCategory: 'NONE',
          },
        },
        visibility: {
          'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
        },
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'X-Restli-Protocol-Version': '2.0.0',
        },
      }
    );

    // Return a generic URL or if the API returns a specific one, construct it
    return `https://www.linkedin.com/feed/update/${postRes.data.id}`;
  }
}

export const jobService = new JobService();
