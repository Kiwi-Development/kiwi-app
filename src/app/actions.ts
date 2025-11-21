"use server"

import { ECSClient, DescribeTasksCommand } from "@aws-sdk/client-ecs"
import { EC2Client, DescribeNetworkInterfacesCommand } from "@aws-sdk/client-ec2"

const ecsClient = new ECSClient({
  region: "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
})

const ec2Client = new EC2Client({
  region: "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
})

export async function getTaskServerUrl(taskArn: string, cluster: string): Promise<string | null> {
  try {
    const command = new DescribeTasksCommand({
      cluster: cluster,
      tasks: [taskArn],
    })
    const data = await ecsClient.send(command)
    const task = data.tasks?.[0]

    if (task?.lastStatus === "PENDING" || task?.lastStatus === "RUNNING") {
      const eniId = task.attachments?.[0]?.details?.find((d) => d.name === "networkInterfaceId")?.value

      if (eniId) {
        const ec2Command = new DescribeNetworkInterfacesCommand({
          NetworkInterfaceIds: [eniId],
        })
        const ec2Data = await ec2Client.send(ec2Command)
        const publicIp = ec2Data.NetworkInterfaces?.[0]?.Association?.PublicIp

        if (publicIp) {
          return `http://${publicIp}:5000`
        }
      }
    }
    return null
  } catch (error) {
    console.error("Error fetching task details:", error)
    return null
  }
}
