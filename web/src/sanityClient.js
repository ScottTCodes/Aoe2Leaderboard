import sanityClient from '@sanity/client'
import { api } from '../../studio/sanity.json'
const { projectId, dataset } = api

const client = sanityClient({
  projectId,
  dataset,
  token: process.env.FRONTEND_TOKEN,
  useCdn: false
})

console.log(process.env.FRONTEND_TOKEN);

export default client
