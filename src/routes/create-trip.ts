import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import dayjs from "dayjs"
import localizedFormat from "dayjs/plugin/localizedFormat"
import 'dayjs/locale/pt-br'
import nodemailer from "nodemailer"
import { z } from "zod"
import { prisma } from "../lib/prisma";
import { getMailClient } from "../lib/mail";

dayjs.locale('pt-br')
dayjs.extend(localizedFormat)
export async function createTrip(app: FastifyInstance) {
    await app.withTypeProvider<ZodTypeProvider>().post('/trips', {
        schema: {
            body: z.object({
                destination: z.string().min(4),
                start_at: z.coerce.date(),
                ends_at: z.coerce.date(),
                owner_name: z.string(),
                owner_email: z.string().email(),
                emails_to_invite: z.array(z.string().email())
            })
        }
    } ,async (request) => {
        const {destination, start_at, ends_at, owner_name ,owner_email, emails_to_invite} = request.body
        if (dayjs(start_at).isBefore(new Date())) {
            throw new Error("invalid trip start date")
        }

        if (dayjs(ends_at).isBefore(start_at)) {
            throw new Error("invalid trip ends date")
        }

        
        const trip = await prisma.trip.create({
            data: {
                destination,
                start_at,
                ends_at,
                participants: {
                    createMany: {
                        data: [
                            {
                            name: owner_name,
                            email: owner_email,
                            is_owner: true,
                            is_confirmed: true,
                        },
                        ...emails_to_invite.map(email => {
                            return { email }
                        })    
                    ]
                    }
                }
            }
        })


        const mail = await getMailClient()

        const formattedStartDate = dayjs(start_at).format("LL")
        const formattedEndDate = dayjs(ends_at).format("LL")
        
        const confirmationLink = `http://localhost:3333/trips/${trip.id}/confirm`

        const message = await mail.sendMail({
            from: {
                name: "equipe plann.er",
                address: "plann@er.com",
            },
            to: {
                name: owner_name,
                address: owner_email,
            },
            subject: `Confirme sua viagem para ${destination}`,
            html: `
            <div style="font-family: sans-serif; line-height: 1.6; font-size: 16px;">
                <p>Plann.er</p>
                <p>Confirme sua viagem para <strong>${destination}</strong> para os dias <strong>${formattedStartDate}</strong> até <strong>${formattedEndDate}</strong></p>
                <a href="${confirmationLink}">Confirmar Viagem</a>
            </div>
            `.trim()
        })

        console.log(nodemailer.getTestMessageUrl(message))

        return { tripId: trip.id } 
    })
}