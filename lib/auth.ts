import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import { DynamoDBDocumentClient, GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb"
import bcrypt from "bcryptjs"

// Configure AWS DynamoDB client
const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "us-east-1",
})

const docClient = DynamoDBDocumentClient.from(client)

export interface User {
  id: string
  email: string
  name?: string
  password: string
  createdAt: string
  updatedAt: string
}

// Function to find user by email
async function getUserByEmail(email: string): Promise<User | null> {
  try {
    const command = new QueryCommand({
      TableName: "users",
      IndexName: "email-index",
      KeyConditionExpression: "email = :email",
      ExpressionAttributeValues: {
        ":email": email,
      },
    })

    const response = await docClient.send(command)
    
    if (response.Items && response.Items.length > 0) {
      return response.Items[0] as User
    }
    
    return null
  } catch (error) {
    console.error("Error fetching user:", error)
    return null
  }
}

// Function to verify password
async function verifyPassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(plainPassword, hashedPassword)
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password are required")
        }

        const user = await getUserByEmail(credentials.email)
        
        if (!user) {
          throw new Error("Invalid email or password")
        }

        const isValidPassword = await verifyPassword(credentials.password, user.password)
        
        if (!isValidPassword) {
          throw new Error("Invalid email or password")
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name || user.email,
        }
      }
    })
  ],
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours
  },
  jwt: {
    maxAge: 24 * 60 * 60, // 24 hours
  },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string
      }
      return session
    },
  },
}
